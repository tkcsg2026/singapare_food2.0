import { NextResponse } from "next/server";
import { KITCHENWARE_RETAILERS } from "@/data/kitchenwareRetailers";
import { KITCHENWARE_SHOWCASE } from "@/data/kitchenwareShowcase";

/** Curated retailer + inspiration data (JSON). Optional seed for admin tooling — not marketplace inventory. */
export async function GET() {
  return NextResponse.json({
    retailers: KITCHENWARE_RETAILERS,
    showcase: KITCHENWARE_SHOWCASE,
    updated: "2026-03-23",
  });
}
