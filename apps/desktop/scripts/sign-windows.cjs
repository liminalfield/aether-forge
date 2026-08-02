/**
 * Windows signing hook.
 *
 * Signing is deliberately not set up (00-PROJECT-BRIEF.md): releases are
 * unsigned and SmartScreen click-through is accepted. This hook exists so that
 * turning signing on later is a credentials-and-config change rather than a
 * build-pipeline change.
 *
 * With no credentials in the environment it no-ops, and electron-builder ships
 * the binary unsigned. If a signing provider is ever adopted, implement it here
 * behind the same environment check.
 */

/** @param {{ path: string }} configuration */
module.exports = async function sign(configuration) {
  const hasCredentials = Boolean(
    process.env.WINDOWS_SIGN_TOKEN ?? process.env.WINDOWS_CERTIFICATE_FILE,
  );

  if (!hasCredentials) {
    console.log(`[sign-windows] no signing credentials; leaving unsigned: ${configuration.path}`);
    return;
  }

  throw new Error(
    '[sign-windows] signing credentials are present but no signing implementation is configured. ' +
      'Implement the provider call in apps/desktop/scripts/sign-windows.cjs before setting these variables.',
  );
};
