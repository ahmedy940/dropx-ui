export const redirectWithError = (message: string, baseUrl: string) => ({
  statusCode: 302,
  headers: {
    Location: `${baseUrl}/auth/error?message=${encodeURIComponent(message)}`,
  },
  body: "",
});
