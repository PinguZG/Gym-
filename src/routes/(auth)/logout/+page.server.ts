import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { invalidateSession, clearSessionCookie } from '$lib/server/auth/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  redirect(303, '/login');
};

export const actions: Actions = {
  default: ({ locals, cookies }) => {
    if (locals.sessionId) invalidateSession(locals.sessionId);
    clearSessionCookie(cookies, dev);
    locals.user = null;
    locals.sessionId = null;
    redirect(303, '/login');
  }
};
