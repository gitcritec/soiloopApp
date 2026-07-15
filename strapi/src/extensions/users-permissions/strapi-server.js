'use strict';

/**
 * Override forgot-password: envia email via plugin email.send() (sem sendTemplatedEmail).
 * Copiar para o servidor Strapi: src/extensions/users-permissions/strapi-server.js
 * Reiniciar Strapi após deploy.
 *
 * Opcional no .env do servidor:
 *   FRONTEND_RESET_PASSWORD_URL=http://localhost:5173/#/redefinir-palavra-passe
 */

const crypto = require('crypto');

/**
 * @param {import('@strapi/strapi').Core.Strapi} strapi
 * @param {string} token
 */
async function buildResetUrl(strapi, token) {
  const encoded = encodeURIComponent(token);
  const fromEnv = process.env.FRONTEND_RESET_PASSWORD_URL || process.env.FRONTEND_URL;

  if (fromEnv && String(fromEnv).trim()) {
    const base = String(fromEnv).trim().replace(/\/+$/, '');
    if (base.includes('?')) return `${base}&code=${encoded}`;
    return `${base}?code=${encoded}`;
  }

  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advanced = await pluginStore.get({ key: 'advanced' });
    const resetPage = advanced?.email_reset_password;
    if (resetPage && String(resetPage).trim()) {
      const base = String(resetPage).trim().replace(/\/+$/, '');
      if (base.includes('?')) return `${base}&code=${encoded}`;
      return `${base}?code=${encoded}`;
    }
  } catch (err) {
    strapi.log.warn('[soiloop] Não foi possível ler email_reset_password:', err);
  }

  return `http://localhost:5173/#/redefinir-palavra-passe?code=${encoded}`;
}

/**
 * @param {import('@strapi/strapi').Core.Strapi} strapi
 */
function resolveFromAddress(strapi) {
  return (
    process.env.SMTP_DEFAULT_FROM ||
    strapi.config.get('plugin.email.settings.defaultFrom') ||
    'no-reply@critecws.com'
  );
}

/**
 * @param {import('@strapi/strapi').Core.Strapi} strapi
 * @param {{ email: string }} user
 * @param {string} token
 */
async function sendResetEmail(strapi, user, token) {
  const resetUrl = await buildResetUrl(strapi, token);
  const from = resolveFromAddress(strapi);

  await strapi.plugin('email').service('email').send({
    to: user.email,
    from,
    replyTo: from,
    subject: 'Soiloop — Definir a sua palavra-passe',
    text: [
      'Olá,',
      '',
      'Recebemos um pedido para definir ou redefinir a palavra-passe da sua conta Soiloop.',
      '',
      `Use este link: ${resetUrl}`,
      '',
      'Se não pediu este email, ignore esta mensagem.',
    ].join('\n'),
    html: [
      '<p>Olá,</p>',
      '<p>Recebemos um pedido para <strong>definir ou redefinir a palavra-passe</strong> da sua conta Soiloop.</p>',
      `<p><a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#40534c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Definir palavra-passe</a></p>`,
      '<p style="font-size:13px;color:#5c6d66;">Se não pediu este email, ignore esta mensagem.</p>',
    ].join(''),
  });
}

/**
 * @param {import('@strapi/strapi').Core.Strapi} strapi
 */
async function soiloopForgotPassword(ctx, strapi) {
  const email = ctx.request.body?.email;
  if (!email || typeof email !== 'string' || !email.trim()) {
    return ctx.badRequest('email.required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { email: normalizedEmail },
  });

  if (!user || user.blocked) {
    return ctx.send({ ok: true });
  }

  const resetPasswordToken = crypto.randomBytes(64).toString('hex');

  await strapi.db.query('plugin::users-permissions.user').update({
    where: { id: user.id },
    data: { resetPasswordToken },
  });

  try {
    await sendResetEmail(strapi, user, resetPasswordToken);
  } catch (err) {
    strapi.log.error('[soiloop] forgotPassword — falha ao enviar email:', err);
    return ctx.internalServerError('Não foi possível enviar o email de palavra-passe.');
  }

  return ctx.send({ ok: true });
}

module.exports = (plugin) => {
  const originalAuthFactory = plugin.controllers.auth;

  if (typeof originalAuthFactory === 'function') {
    plugin.controllers.auth = ({ strapi }) => {
      const originalAuth = originalAuthFactory({ strapi });
      return {
        ...originalAuth,
        forgotPassword: (ctx) => soiloopForgotPassword(ctx, strapi),
      };
    };
    return plugin;
  }

  plugin.controllers.auth.forgotPassword = (ctx) => soiloopForgotPassword(ctx, strapi);
  return plugin;
};
