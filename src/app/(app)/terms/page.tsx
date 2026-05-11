import { TermsContent } from "@/components/TermsContent";

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
      <div className="glass-card p-6 md:p-8">
        <TermsContent />
      </div>
    </div>
  );
}
