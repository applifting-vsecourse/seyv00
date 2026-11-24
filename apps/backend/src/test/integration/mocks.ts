// react-email's render() loads its renderer with a dynamic import(), which
// Jest's CommonJS VM can't run. Sign-up sends a verification email, so stub
// only the HTML rendering; the mail service itself still runs (console adapter).
jest.mock('@/core/email/render', () => ({
  renderEmail: async (): Promise<string> => '<p>email</p>',
}));
