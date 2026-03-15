"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import GraphsSection from "@/components/GraphsSection";
import { QuizTable } from "@/components/quiz-table";
import { useAuth } from "@/app/context/auth-context";
import TodayPanel from "@/components/today-panel";

export default function Page() {
  const { user, loading } = useAuth();
  const email = user?.email ?? "";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />

              <div className="px-4 lg:px-6 space-y-6">
                <TodayPanel />
                <QuizTable />
                {!loading && <GraphsSection email={email} />}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}