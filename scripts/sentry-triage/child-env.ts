/** Only execution plumbing and Sentry credentials cross the untrusted-data boundary. */
export function sentryChildEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const names = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'SYSTEMROOT',
    'WINDIR',
    'COMSPEC',
    'PATHEXT',
    'TEMP',
    'TMP',
    'TMPDIR',
    'XDG_CACHE_HOME',
    'NODE_EXTRA_CA_CERTS',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'SENTRY_ACCESS_TOKEN',
    'SENTRY_ORG_SLUG',
  ]
  const childEnv = { ...env }
  for (const name of Object.keys(childEnv)) {
    if (!names.includes(name)) delete childEnv[name]
  }
  return childEnv
}
