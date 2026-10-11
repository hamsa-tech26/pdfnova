export default {
  testDir: "./e2e",
  testMatch: "pdf_to_excel.spec.mjs",
  timeout: 150000,
  use: { baseURL: "http://127.0.0.1:3000", browserName: "chromium", headless: true },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: "list",
};
