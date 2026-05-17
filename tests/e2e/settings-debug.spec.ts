import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"

const debugDir = path.join(process.cwd(), "test-results", "settings-debug")

test("captures AI settings provider diagnostics", async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim())
  })

  await page.goto("/settings", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle").catch(() => undefined)

  await mkdir(debugDir, { recursive: true })

  const currentUrl = page.url()
  const redirectedToLogin = /\/auth\/login/.test(new URL(currentUrl).pathname)
  const screenshotPath = testInfo.outputPath("settings-debug.png")
  await page.screenshot({ path: screenshotPath, fullPage: true })

  const visibleText = await page.locator("body").innerText().catch(() => "")
  const diagnostics = {
    url: currentUrl,
    redirectedToLogin,
    providerText: pickLine(visibleText, /OpenRouter|OpenAI|Anthropic|Mock Provider|Google Gemini|Mistral/i),
    modelText: pickLine(visibleText, /Model:/i),
    keySourceText: pickLine(visibleText, /Key source:/i),
    keyStatusText: pickLine(visibleText, /User key|No user key/i),
    consoleErrors,
    failedRequests,
    screenshot: screenshotPath,
  }

  await writeFile(
    path.join(debugDir, "settings-debug.json"),
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    "utf8"
  )

  testInfo.attach("settings diagnostics", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  })

  if (redirectedToLogin) {
    test.skip(true, "Settings requires login; run with an authenticated browser/session to test save/load.")
  }

  await expect(page.getByText("AI Provider")).toBeVisible()
  await expect(page.getByText("OpenRouter")).toBeVisible()
})

function pickLine(text: string, pattern: RegExp) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => pattern.test(line)) ?? null
}
