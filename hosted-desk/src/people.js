/* Who may use the Content Studio and what they may do. The list is kept by the Desk in the store
   (desk/people.json); a person is their Cloudflare Access sign-in email.

   Roles (a person can have more than one):
   - superadmin  everything, and manages everyone's roles
   - coder       changes the code of the Studio, the Desk and the site (in Claude Code, GitHub and Cloudflare)
   - producer    changes the structure (kinds, topics; later layout settings) in Claude Code, in the repo's
                 structure/ folder, never in the Studio; in the Studio, adds producers and editors
   - editor      writes, edits and publishes content in the structure as it is

   Editors use the Content Studio only. Producers and coders work in Claude Code too. */

export const ROLES = ["superadmin", "coder", "producer", "editor"];
export const ROLE_NAMES = { superadmin: "Super admin", coder: "Coder", producer: "Producer", editor: "Editor" };

const has = (roles, ...any) => any.some((r) => (roles || []).includes(r));
export const can = {
  content: (roles) => has(roles, "superadmin", "coder", "producer", "editor"),
  people: (roles) => has(roles, "superadmin", "producer"),
};
/* the roles a person may give: a super admin any, a producer only producer and editor */
export const grantable = (roles) => has(roles, "superadmin") ? ROLES.slice() : has(roles, "producer") ? ["producer", "editor"] : [];
/* may this person change (or remove) someone with these roles? a producer only producers and editors */
export const mayManage = (actorRoles, targetRoles) => {
  const g = grantable(actorRoles);
  return g.length > 0 && (targetRoles || []).every((r) => g.includes(r));
};

export const cleanEmail = (x) => String(x || "").trim().toLowerCase();
export const validEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x) && x.length <= 120;
export const rolesOf = (people, email) => ((people || []).find((p) => p.email === cleanEmail(email)) || {}).roles || [];

/* the list as stored; when there is none yet, the super admin set on the Worker (SUPERADMIN_EMAIL) starts it */
export function startingPeople(env) {
  const e = cleanEmail(env.SUPERADMIN_EMAIL);
  return validEmail(e) ? [{ email: e, name: "", roles: ["superadmin", "coder"], added_by: "setup", added_at: new Date().toISOString().slice(0, 19) }] : [];
}
