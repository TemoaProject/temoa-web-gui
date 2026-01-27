import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "./App";

// Mock global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(["appsi_highs", "cbc"]),
  }),
);

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  onopen: vi.fn(),
  onclose: vi.fn(),
  onmessage: vi.fn(),
  onerror: vi.fn(),
}));

test("renders TEMOA GUI logo", async () => {
  render(<App />);
  const logoElement = await screen.findByAltText(/Temoa Logo/i);
  expect(logoElement).toBeDefined();
});

test("renders setup instructions on dashboard", async () => {
  render(<App />);
  expect(await screen.findByText(/Client Setup Instructions/i)).toBeDefined();
  expect(await screen.findByText(/Install uv/i)).toBeDefined();
});

test("renders navigation items", async () => {
  render(<App />);
  expect(await screen.findByText(/Dashboard/i)).toBeDefined();
  expect(await screen.findByText(/Live Logs/i)).toBeDefined();
  expect(await screen.findByText(/Network Visualizer/i)).toBeDefined();
});
