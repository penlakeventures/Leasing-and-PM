import { Card, Button } from "@/components/ui";

export function DocumentUploadPanel({
  documentLink,
  canUpload,
  uploadAction,
}: {
  documentLink: string | null;
  canUpload: boolean;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">Documents</h2>
      {documentLink ? (
        <p className="mb-3 text-sm">
          <a href={documentLink} target="_blank" rel="noopener noreferrer" className="underline">
            Open this lease&apos;s Dropbox folder →
          </a>
        </p>
      ) : (
        <p className="mb-3 text-sm text-neutral-500">
          No Dropbox folder linked yet — add a document link above once one exists.
        </p>
      )}
      {canUpload ? (
        <form action={uploadAction} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            required
            className="block text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
          />
          <Button type="submit" variant="secondary">
            Upload to Dropbox
          </Button>
        </form>
      ) : (
        <p className="text-xs text-neutral-500">
          Uploading straight from here isn&apos;t available for this lease — drag files into the folder
          above via Dropbox directly instead.
        </p>
      )}
    </Card>
  );
}
