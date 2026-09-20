import { defineConfig, devices } from '@playwright/test';

const liveBaseURL=process.env.ELSEWHERE_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: liveBaseURL??'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: liveBaseURL?undefined:{ command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], reducedMotion: 'reduce' } },
  ],
});
