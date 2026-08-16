/**
 * Browser E2E: Project Genesis slice.
 * Exercises project creation, brief interpretation, ChangeSet
 * validation/approval, structured brief editing, and rules CRUD —
 * all through the real UI against the real API + database.
 */
import { test, expect, type Page } from "@playwright/test";

const BRIEF_TEXT =
  "The client wants a 2-story restaurant on a 20m x 30m site. " +
  "Floor to floor heights should be 3500mm. Minimum corridor width 1200mm.";

async function openArea(page: Page, label: string) {
  await page.getByRole("button", { name: label }).click();
}

test.describe.configure({ mode: "serial" });

const projectName = `E2E Genesis ${Date.now()}`;

test("full genesis flow: create, interpret, validate, approve, edit brief, rules CRUD", async ({
  page,
}) => {
  // --- 1. Create a project with a natural-language brief -------------------
  await page.goto("/projects/new");
  await page.getByPlaceholder("e.g. Apex Tower").fill(projectName);
  await page.getByPlaceholder(/10-story commercial building/).fill(BRIEF_TEXT);
  // The primary button reads "Interpret Brief" when a brief text is present.
  await page
    .getByRole("button", { name: /Interpret Brief|Create Project/ })
    .click();

  // Step 2: deterministic interpretation shown for review.
  await expect(page.getByText("Brief successfully interpreted")).toBeVisible();
  await page
    .getByRole("button", { name: /Submit as Proposed ChangeSet/ })
    .click();

  // Lands in the workspace.
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  // --- 2. Validate and approve the initial ChangeSet -----------------------
  await openArea(page, "ChangeSets");
  await page.getByText("Initial project brief interpretation").click();
  await page.getByRole("button", { name: "Run Validation" }).click();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("COMMITTED").first()).toBeVisible();

  // --- 3. Approved brief is canonical --------------------------------------
  await openArea(page, "Brief");
  await expect(page.getByText("20000mm × 30000mm")).toBeVisible();

  // --- 4. Structured brief editor proposes a governed ChangeSet ------------
  await page.getByTestId("button-edit-brief").click();
  await page.getByTestId("input-target-gfa").fill("475");
  await page.getByTestId("button-submit-brief-change").click();
  await expect(page.getByTestId("notice-brief-proposed")).toBeVisible();

  // Approved brief unchanged until the ChangeSet is approved.
  await expect(page.getByText("475 sqm")).not.toBeVisible();

  // Validate + approve the brief edit through the ChangeSets area.
  await openArea(page, "ChangeSets");
  await page.getByText("Brief edited via structured form").click();
  await page.getByRole("button", { name: "Run Validation" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("COMMITTED").first()).toBeVisible();

  await openArea(page, "Brief");
  await expect(page.getByText("475 sqm")).toBeVisible();

  // --- 5. Rules CRUD: add a rule through the governed pipeline -------------
  await openArea(page, "Rules & Governance");
  await page.getByTestId("button-add-rule").click();
  await page.getByTestId("input-rule-code").fill("E2E-RULE-1");
  await page.getByTestId("input-rule-category").fill("Testing");
  await page.getByTestId("input-rule-description").fill("E2E created rule");
  await page.getByTestId("select-rule-subject").selectOption("corridorWidthMm");
  await page.getByTestId("select-rule-operator").selectOption(">=");
  await page.getByTestId("input-rule-value").fill("1000");
  await page.getByTestId("input-rule-unit").fill("mm");
  await page.getByTestId("select-rule-severity").selectOption("INFO");
  await page.getByTestId("button-submit-rule").click();
  await expect(page.getByTestId("notice-rule-proposed")).toBeVisible();

  // Rule is not active until its ChangeSet is approved.
  await expect(page.getByText("E2E created rule")).not.toBeVisible();

  await openArea(page, "ChangeSets");
  await page.getByText("Add rule E2E-RULE-1").click();
  await page.getByRole("button", { name: "Run Validation" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("COMMITTED").first()).toBeVisible();

  await openArea(page, "Rules & Governance");
  await expect(page.getByText("E2E created rule")).toBeVisible();

  // --- 6. Edit the rule -----------------------------------------------------
  await page.getByTestId("button-edit-rule-E2E-RULE-1").click();
  await page.getByTestId("input-rule-value").fill("1100");
  await page.getByTestId("button-submit-rule").click();
  await expect(page.getByTestId("notice-rule-proposed")).toBeVisible();

  await openArea(page, "ChangeSets");
  await page.getByText("Edit rule E2E-RULE-1").click();
  await page.getByRole("button", { name: "Run Validation" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("COMMITTED").first()).toBeVisible();

  await openArea(page, "Rules & Governance");
  await expect(page.getByText("1100 mm")).toBeVisible();

  // --- 7. Deactivate the rule ------------------------------------------------
  await page.getByTestId("button-deactivate-rule-E2E-RULE-1").click();
  await expect(page.getByTestId("notice-rule-proposed")).toBeVisible();

  await openArea(page, "ChangeSets");
  await page.getByText("Deactivate rule E2E-RULE-1").click();
  await page.getByRole("button", { name: "Run Validation" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("COMMITTED").first()).toBeVisible();

  await openArea(page, "Rules & Governance");
  // The rule stays listed but is inactive: its Deactivate button disappears.
  await expect(page.getByText("E2E created rule")).toBeVisible();
  await expect(
    page.getByTestId("button-deactivate-rule-E2E-RULE-1"),
  ).not.toBeVisible();
});
