const path = require('path');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { readJson, writeJson } = require('./jsonStore');
const { getSettings } = require('./guildSettings');
const { logModAction } = require('./modService');

const lockdownsFile = path.join(__dirname, '..', 'data', 'lockdowns.json');

// key: `${guildId}:${userId}:${type}` -> timestamps (ms)
const actionCounters = new Map();
// guildId -> { joins: [{ id, ts }], raidUntil: number }
const raidState = new Map();
// voorkomt dubbel straffen binnen hetzelfde window
const punished = new Set();

function recordAction(guildId, userId, type, limit, windowSeconds) {
	const key = `${guildId}:${userId}:${type}`;
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const timestamps = (actionCounters.get(key) || []).filter(ts => now - ts < windowMs);
	timestamps.push(now);
	actionCounters.set(key, timestamps);
	return timestamps.length >= limit;
}

function isWhitelisted(guild, userId, member, settings) {
	if (userId === guild.ownerId) return true;
	if (userId === guild.client.user.id) return true;
	const anti = settings.antiNuke || {};
	if ((anti.whitelistUserIds || []).includes(userId)) return true;
	if (member && (anti.whitelistRoleIds || []).some(roleId => member.roles.cache.has(roleId))) return true;
	return false;
}

async function resolveAuditActor(guild, auditType, targetId) {
	const me = guild.members.me;
	if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

	const logs = await guild.fetchAuditLogs({ type: auditType, limit: 5 }).catch(() => null);
	if (!logs) return null;

	const entry = logs.entries.find(e =>
		e.targetId === targetId && Date.now() - e.createdTimestamp < 5000,
	);
	return entry?.executor || null;
}

async function punishNuker(guild, userId, reason) {
	const punishKey = `${guild.id}:${userId}`;
	if (punished.has(punishKey)) return;
	punished.add(punishKey);
	setTimeout(() => punished.delete(punishKey), 60_000);

	const member = await guild.members.fetch(userId).catch(() => null);
	let outcome;

	if (!member) {
		outcome = '⚠️ Dader is geen lid (meer) — kon geen rollen afnemen.';
	} else {
		const me = guild.members.me;
		const canManage = me?.permissions.has(PermissionFlagsBits.ManageRoles)
			&& me.roles.highest.position > member.roles.highest.position;
		if (canManage) {
			const keepRoles = member.roles.cache.filter(r => r.managed);
			const stripped = await member.roles.set(keepRoles).then(() => true).catch(err => {
				console.error(`Anti-nuke: failed to strip roles from ${userId} in ${guild.id}:`, err.message);
				return false;
			});
			outcome = stripped
				? '✅ Alle rollen van de dader zijn afgenomen.'
				: '❌ Rollen afnemen mislukt — **HANDMATIGE ACTIE VEREIST**.';
		} else {
			outcome = '❌ Bot mist permissies of staat te laag in de hiërarchie — **HANDMATIGE ACTIE VEREIST**.';
		}
	}

	await logModAction(guild, {
		action: '🚨 ANTI-NUKE TRIGGERED',
		moderator: guild.client.user,
		target: member?.user || { id: userId, toString: () => `<@${userId}>` },
		reason,
		extra: outcome,
		ping: `<@${guild.ownerId}> — controleer dit onmiddellijk!`,
	}).catch(err => console.error('Anti-nuke: modlog failed:', err.message));
}

async function handleDestructiveAction(guild, auditType, targetId, counterType, limitKey, reasonText) {
	const settings = getSettings(guild.id);
	const anti = settings.antiNuke || {};
	if (!anti.enabled) return;

	const actor = await resolveAuditActor(guild, auditType, targetId);
	if (!actor || actor.id === guild.client.user.id) return;

	const member = await guild.members.fetch(actor.id).catch(() => null);
	if (isWhitelisted(guild, actor.id, member, settings)) return;

	const limit = anti[limitKey] ?? 3;
	const windowSeconds = anti.windowSeconds ?? 10;
	if (recordAction(guild.id, actor.id, counterType, limit, windowSeconds)) {
		await punishNuker(guild, actor.id, `${reasonText} (${limit}x binnen ${windowSeconds}s)`);
	}
}

async function handleChannelDelete(channel) {
	if (!channel.guild) return;
	await handleDestructiveAction(channel.guild, AuditLogEvent.ChannelDelete, channel.id, 'channelDelete', 'channelDeleteLimit', 'Massaal kanalen verwijderen gedetecteerd');
}

async function handleRoleDelete(role) {
	await handleDestructiveAction(role.guild, AuditLogEvent.RoleDelete, role.id, 'roleDelete', 'roleDeleteLimit', 'Massaal rollen verwijderen gedetecteerd');
}

async function handleBanAdd(ban) {
	await handleDestructiveAction(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, 'banKick', 'banKickLimit', 'Massaal bannen gedetecteerd');
}

async function handleMemberRemove(member) {
	// Alleen tellen als dit een kick was (verse audit entry); anders vrijwillige leave
	await handleDestructiveAction(member.guild, AuditLogEvent.MemberKick, member.id, 'banKick', 'banKickLimit', 'Massaal kicken gedetecteerd');
}

function readLockdowns() {
	return readJson(lockdownsFile, {});
}

async function activateLockdown(guild, settings) {
	const lockdowns = readLockdowns();
	if (lockdowns[guild.id]) return;

	const minutes = settings.antiRaid?.lockdownMinutes ?? 10;
	const me = guild.members.me;
	if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
		console.error(`Anti-raid: missing ManageGuild for lockdown in ${guild.id}`);
		return;
	}

	const previousLevel = guild.verificationLevel;
	const applied = await guild.setVerificationLevel(4, 'Anti-raid lockdown').then(() => true).catch(err => {
		console.error(`Anti-raid: lockdown failed in ${guild.id}:`, err.message);
		return false;
	});
	if (!applied) return;

	lockdowns[guild.id] = { previousLevel, until: Date.now() + minutes * 60_000 };
	writeJson(lockdownsFile, lockdowns);

	await logModAction(guild, {
		action: '🔒 LOCKDOWN ACTIEF',
		moderator: guild.client.user,
		target: guild.client.user,
		reason: `Raid gedetecteerd — verificatieniveau op maximum voor ${minutes} minuten.`,
		ping: `<@${guild.ownerId}> — server staat tijdelijk op slot.`,
	}).catch(() => null);
}

async function checkLockdowns(client) {
	const lockdowns = readLockdowns();
	let changed = false;

	for (const [guildId, info] of Object.entries(lockdowns)) {
		if (Date.now() < info.until) continue;
		const guild = client.guilds.cache.get(guildId);
		if (guild) {
			await guild.setVerificationLevel(info.previousLevel, 'Anti-raid lockdown verlopen').catch(err => {
				console.error(`Anti-raid: failed to lift lockdown in ${guildId}:`, err.message);
			});
			await logModAction(guild, {
				action: '🔓 Lockdown opgeheven',
				moderator: client.user,
				target: client.user,
				reason: 'De anti-raid lockdown is verlopen; verificatieniveau hersteld.',
			}).catch(() => null);
		}
		delete lockdowns[guildId];
		changed = true;
	}

	if (changed) writeJson(lockdownsFile, lockdowns);
}

async function kickMember(member, reason) {
	const me = member.guild.members.me;
	if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) return false;
	if (me.roles.highest.position <= member.roles.highest.position) return false;
	return member.kick(reason).then(() => true).catch(err => {
		console.error(`Anti-raid: kick ${member.id} failed:`, err.message);
		return false;
	});
}

async function handleMemberJoin(member) {
	const guild = member.guild;
	const settings = getSettings(guild.id);
	const raid = settings.antiRaid || {};
	if (!raid.enabled || member.user.bot) return { kicked: false };

	// 1. Account-age gate
	if (raid.accountAgeEnabled) {
		const minDays = raid.minAccountAgeDays ?? 7;
		const ageMs = Date.now() - member.user.createdTimestamp;
		if (ageMs < minDays * 86_400_000) {
			const ageDays = Math.floor(ageMs / 86_400_000);
			const kicked = await kickMember(member, `Account te jong (${ageDays}d, minimum ${minDays}d)`);
			if (kicked) {
				await logModAction(guild, {
					action: '🛡️ Account-age kick',
					moderator: guild.client.user,
					target: member.user,
					reason: `Account is ${ageDays} dagen oud (minimum: ${minDays} dagen).`,
				}).catch(() => null);
				return { kicked: true };
			}
		}
	}

	// 2. Raid-detectie (join flood)
	const now = Date.now();
	const windowMs = (raid.windowSeconds ?? 30) * 1000;
	const state = raidState.get(guild.id) || { joins: [], raidUntil: 0 };
	state.joins = state.joins.filter(j => now - j.ts < windowMs);
	state.joins.push({ id: member.id, ts: now });
	raidState.set(guild.id, state);

	const raidActive = now < state.raidUntil;
	const triggered = state.joins.length >= (raid.joinLimit ?? 8);

	if (!triggered && !raidActive) return { kicked: false };

	if (triggered && !raidActive) {
		// Nieuwe raid: raid-modus aan + iedereen uit het window kicken
		state.raidUntil = now + (raid.lockdownMinutes ?? 10) * 60_000;
		raidState.set(guild.id, state);
		await activateLockdown(guild, settings);

		const toKick = state.joins.slice(-30);
		let kickedCount = 0;
		for (const join of toKick) {
			const raidMember = join.id === member.id ? member : await guild.members.fetch(join.id).catch(() => null);
			if (raidMember && await kickMember(raidMember, 'Anti-raid: join flood')) kickedCount += 1;
		}

		await logModAction(guild, {
			action: '🚨 RAID GEDETECTEERD',
			moderator: guild.client.user,
			target: guild.client.user,
			reason: `${state.joins.length} joins binnen ${raid.windowSeconds ?? 30}s — ${kickedCount} leden gekickt.`,
			ping: `<@${guild.ownerId}> — raid-modus actief.`,
		}).catch(() => null);
		return { kicked: true };
	}

	// Raid-modus nog actief: nieuwe joiners direct kicken
	const kicked = await kickMember(member, 'Anti-raid: raid-modus actief');
	return { kicked };
}

module.exports = {
	handleChannelDelete,
	handleRoleDelete,
	handleBanAdd,
	handleMemberRemove,
	handleMemberJoin,
	checkLockdowns,
};
