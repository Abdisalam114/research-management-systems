/** Default landing after login / portal selection — same for every role. */
export const APP_HOME_PATH = "/dashboard";

export function homeAfterAuth() {
  return APP_HOME_PATH;
}
