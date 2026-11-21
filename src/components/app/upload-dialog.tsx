import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/demo-store";
import {
  checkFile,
  checkPages,
  DOCUMENT_TYPES,
  SIGNING_STATUSES,
  type DocumentType,
  type SigningStatus,
} from "@/lib/uploads";
import { PER_CLIENT_HINT, liveRunsToday } from "@/lib/run-hint";

const NEW = "__new__";
const selectClass = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

export const SAMPLES = [
  {
    href: "/samples/Orbis_Order_Form_SAMPLE.pdf",
    label: "Orbis Order Form",
    detail: "New supplier, three hourly roles. Signed, Order Form.",
  },
  {
    href: "/samples/BrightHire_Amendment_3_SAMPLE.pdf",
    label: "BrightHire Amendment 3",
    detail: "Existing supplier, L2 Hyderabad only. Signed, Amendment.",
  },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Journey D1 to D3: choose or create a supplier, pick a PDF, read its text in the browser. */
export function UploadContractDialog() {
  const { catalog, state, uploadDocument } = useDemo();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [supplierChoice, setSupplierChoice] = useState("");
  const [newName, setNewName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType | "">("");
  const [signing, setSigning] = useState<SigningStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const used = liveRunsToday(state.uploads.runs);

  const reset = () => {
    setSupplierChoice("");
    setNewName("");
    setFile(null);
    setTitle("");
    setDocType("");
    setSigning("");
    setError(null);
    setBusy(false);
  };

  const submit = async () => {
    setError(null);
    if (!supplierChoice) return setError("Choose a supplier or create a new one.");
    if (supplierChoice === NEW && !newName.trim()) return setError("Type the new supplier's name.");
    if (!file) return setError("Choose a PDF file.");
    const fileProblem = checkFile(file);
    if (fileProblem) return setError(fileProblem);
    if (!docType) return setError("Choose the document type.");
    if (!signing) return setError("Choose the signing status.");
    setBusy(true);
    try {
      const { readPdfPages } = await import("@/lib/pdf-text");
      const pages = await readPdfPages(await file.arrayBuffer());
      const pageProblem = checkPages(pages);
      if (pageProblem) {
        setError(pageProblem);
        setBusy(false);
        return;
      }
      const docId = uploadDocument({
        supplier: supplierChoice === NEW ? { newName } : { id: supplierChoice },
        fileName: file.name,
        title: title.trim() || file.name.replace(/\.pdf$/i, "").replace(/_/g, " "),
        documentType: docType,
        signingStatus: signing,
        pages,
      });
      if (!docId) {
        setBusy(false);
        return;
      }
      setOpen(false);
      reset();
      void navigate({ to: "/documents/$docId", params: { docId } });
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "This file could not be read as a PDF.",
      );
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <FileUp className="size-4" />
          Upload Contract
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Contract</DialogTitle>
          <DialogDescription>
            Add a PDF with selectable text. Its page text is read in your browser and kept only in
            this browser. Prices are extracted only when you ask, on the document page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            Upload only non-confidential documents. When you run Extract Prices, the document text
            is sent to the Claude API (Anthropic) for extraction. Use the synthetic samples below if
            you are unsure.
          </p>
        </div>

        <div className="rounded-md border p-3 text-xs">
          <p className="font-medium">Sample PDFs (synthetic)</p>
          <ul className="mt-1.5 space-y-1.5">
            {SAMPLES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {s.label}
                </a>
                <span className="text-muted-foreground">. {s.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted-foreground">Download one, then choose it below.</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Supplier">
            <select
              className={selectClass}
              value={supplierChoice}
              onChange={(e) => setSupplierChoice(e.target.value)}
            >
              <option value="">Choose a supplier</option>
              {catalog.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NEW}>Create a new supplier</option>
            </select>
          </Field>
          {supplierChoice === NEW && (
            <Field label="New supplier name">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
            </Field>
          )}
          <Field
            label="PDF file"
            hint="Up to 25 pages and 80,000 characters of text. Scanned PDFs are not supported."
          >
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Title" hint="Optional. Defaults to the file name.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document type">
              <select
                className={selectClass}
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
              >
                <option value="">Choose a type</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Signing status" hint="Declared, not checked.">
              <select
                className={selectClass}
                value={signing}
                onChange={(e) => setSigning(e.target.value as SigningStatus)}
              >
                <option value="">Choose a status</option>
                {SIGNING_STATUSES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft p-2.5 text-xs text-danger"
            >
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Hint only: {PER_CLIENT_HINT} This browser has started {used} today. The server enforces
            the real limits.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Reading PDF" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
