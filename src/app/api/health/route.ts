// route.ts
// Purpose: Health check endpoint verifying MongoDB Atlas connectivity.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const conn = await connectToDatabase();
    const state = conn.connection.readyState; // 1 = connected
    return NextResponse.json({ status: "ok", mongoReadyState: state });
  } catch (error) {
    console.error("MongoDB health check failed:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to connect to MongoDB" },
      { status: 500 }
    );
  }
}
