import { AppWorkspace } from "@/components/shell/app-workspace";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppWorkspace>{children}</AppWorkspace>;
}
