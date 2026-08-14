#!/usr/bin/env node
"use strict";

const fs = require("fs");
const assert = require("assert");

const FLOW_DURATION_CREDITS = Object.freeze({
  4: 7,
  6: 10,
  8: 12,
  10: 15,
});

const VEO_CREDITS = Object.freeze({
  "veo 3.1 lite": 10,
  "veo 3.1 fast": 20,
  "veo 3.1 quality": 100,
});

function textOf(task) {
  return [
    task.kind,
    task.need,
    task.intent,
    task.archetype,
    task.assetType,
    task.visualType,
    task.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function nearestFlowDuration(seconds) {
  const allowed = Object.keys(FLOW_DURATION_CREDITS).map(Number);
  return allowed.reduce((best, value) => (Math.abs(value - seconds) < Math.abs(best - seconds) ? value : best), 4);
}

function routeVisualTask(task = {}) {
  const text = textOf(task);
  const archetype = String(task.archetype || "").toUpperCase();
  const duration = nearestFlowDuration(Number(task.durationSeconds || task.duration || 4));
  const keyframes = Number(task.keyframes || task.frameCount || 0);
  const references = Number(task.references || task.ingredients || 0);
  const hasStart = Boolean(task.startFrame || task.hasStartFrame);
  const hasEnd = Boolean(task.endFrame || task.hasEndFrame);
  const model = String(task.model || "").toLowerCase();

  if (/STAT_|BAR_CHART|LINE_GRAPH|PIE_CHART|FLOW_DIAGRAM|TEXT_ANNOTATION/.test(archetype) || /chart|graph|counter|title|lower third/.test(text)) {
    return {
      tool: "remotion_component",
      capability: "remotion.build",
      reason: "Structured text/data visuals belong in Remotion, not generated images.",
      requiresBrowserAuth: false,
      flowCreditsPlanned: 0,
      dreaminaCreditsPlanned: 0,
    };
  }

  if (/DOC_HIGHLIGHT|SCREENSHOT_HIGHLIGHT/.test(archetype) || task.sourceUrl || /article|screenshot|citation|report/.test(text)) {
    return {
      tool: "article_capture",
      capability: "browser.source_capture",
      reason: "Evidence visuals should use real source capture.",
      requiresBrowserAuth: false,
      requiresScout: false,
      flowCreditsPlanned: 0,
      dreaminaCreditsPlanned: 0,
    };
  }

  if (/pexels|stock|real-world|real world|documentary b-roll/.test(text)) {
    return {
      tool: "pexels",
      capability: "stock_video.search_download",
      reason: "Real-world documentary B-roll should use real footage first.",
      requiresBrowserAuth: false,
      flowCreditsPlanned: 0,
      dreaminaCreditsPlanned: 0,
    };
  }

  if (/edit|surgical|trim|relight|remove object|change object/.test(text)) {
    return {
      tool: "google_flow",
      capability: "flow.omni_edit",
      reason: "Use Omni edit only for targeted clip edits.",
      requiredModel: "Gemini Omni Flash",
      requiresBrowserAuth: true,
      requiresScout: true,
      creditRisk: "High; spend only with explicit approval.",
    };
  }

  if (keyframes >= 2 || /multi[- ]?frame|journey|morph|2-10 keyframes/.test(text)) {
    return {
      tool: "dreamina",
      capability: "dreamina.multiframes",
      reason: "2-10 keyframe journeys fit Dreamina Multiframes.",
      requiresBrowserAuth: true,
      requiresScout: true,
      dreaminaCreditsPlanned: task.dreaminaCreditsPlanned ?? null,
    };
  }

  if (hasStart || hasEnd || /frames?|start frame|end frame|image-first video|animate still/.test(text)) {
    return {
      tool: "google_flow",
      capability: hasEnd ? "flow.frames_to_video" : references > 0 ? "flow.ingredients_to_video" : "flow.frames_to_video",
      reason: hasEnd ? "Start/end frame video belongs in Flow Frames." : "Image-first animation belongs in Flow.",
      durationSeconds: duration,
      requiredModel: model.includes("veo") ? task.model : "Flow frame-video model selected in UI",
      requiresBrowserAuth: true,
      requiresScout: true,
      flowCreditsPlanned: FLOW_DURATION_CREDITS[duration],
    };
  }

  if (references > 0 || /ingredient|reference|identity lock|style lock|environment lock/.test(text)) {
    return {
      tool: "google_flow",
      capability: "flow.ingredients_to_video",
      reason: "Reference-guided consistency belongs in Flow Ingredients.",
      durationSeconds: duration,
      requiresBrowserAuth: true,
      requiresScout: true,
      flowCreditsPlanned: FLOW_DURATION_CREDITS[duration],
    };
  }

  if (/nano banana|photoreal|character|product|consistency|refinement|start frame/.test(text) && !/text|diagram|data/.test(text)) {
    return {
      tool: "google_flow",
      capability: "flow.image_model",
      reason: "Flow Nano Banana 2/Pro is the repeated image/refinement lane.",
      requiredModel: task.model || "Nano Banana 2/Pro",
      requiresBrowserAuth: true,
      requiresScout: true,
      flowCreditsPlanned: 0,
      budgetNote: "Operator treats Flow Nano Banana image generation as unlimited; still verify selected model in UI.",
    };
  }

  if (model in VEO_CREDITS) {
    return {
      tool: "google_flow",
      capability: "flow.frames_to_video",
      reason: "Explicit Veo model requested.",
      requiredModel: task.model,
      requiresBrowserAuth: true,
      requiresScout: true,
      flowCreditsPlanned: VEO_CREDITS[model],
    };
  }

  return {
    tool: "dreamina",
    capability: "dreamina.still_image",
    reason: "Default generated still route.",
    requiredModel: "GPT Image 2 / ChatGPT Image 2",
    requiresBrowserAuth: true,
    requiresScout: true,
    dreaminaCreditsPlanned: task.dreaminaCreditsPlanned ?? null,
    batchSize: 4,
    guardrail: "GPT Image 2 must be selected in Dreamina AI Image, not AI Agent. It generates 4 images per run; stop if GPT Image 2 cannot be confirmed.",
  };
}

function selfTest() {
  assert.equal(routeVisualTask({ archetype: "BAR_CHART" }).tool, "remotion_component");
  assert.equal(routeVisualTask({ sourceUrl: "https://example.com" }).capability, "browser.source_capture");
  assert.equal(routeVisualTask({ hasStartFrame: true, durationSeconds: 8 }).flowCreditsPlanned, 12);
  assert.equal(routeVisualTask({ references: 2, durationSeconds: 10 }).capability, "flow.ingredients_to_video");
  assert.equal(routeVisualTask({ keyframes: 4 }).capability, "dreamina.multiframes");
  assert.match(routeVisualTask({ need: "text/data diagram still" }).requiredModel, /GPT Image 2/);
  assert.equal(routeVisualTask({ need: "photoreal character consistency nano banana" }).capability, "flow.image_model");
}

function main(argv) {
  if (argv.includes("--self-test")) {
    selfTest();
    console.log("visual_tool_router self-test OK");
    return;
  }

  const file = argv[2];
  if (!file) {
    console.error("Usage: node tools/visual_tool_router.js <task.json> | --self-test");
    process.exit(2);
  }

  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  const output = Array.isArray(input) ? input.map(routeVisualTask) : routeVisualTask(input);
  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) main(process.argv);

module.exports = {
  FLOW_DURATION_CREDITS,
  VEO_CREDITS,
  routeVisualTask,
};
