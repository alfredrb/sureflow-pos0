import React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import moment from "moment";

const isImage = (url = "") => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
const isPdf = (url = "") => /\.pdf(\?|$)/i.test(url);

export default function EvidenceViewerDialog({ evidence, onClose }) {
  if (!evidence) return null;
  const title = evidence.document_title || evidence.file_name || (evidence.type === "receipt" ? `Receipt ${evidence.ref || ""}` : "Evidence");

  return (
    <Dialog open={!!evidence} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 capitalize">
            <FileText className="w-4 h-4 text-gray-500" />
            {evidence.type} Evidence — {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {evidence.detail && <p className="text-sm text-gray-600">{evidence.detail}</p>}
          {evidence.date && <p className="text-xs text-gray-400">{moment(evidence.date).format("MMM D, YYYY h:mm A")}</p>}

          {evidence.type === "document" && evidence.document_html && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 overflow-x-auto" dangerouslySetInnerHTML={{ __html: evidence.document_html }} />
          )}

          {evidence.type === "file" && evidence.file_url && isImage(evidence.file_url) && (
            <img src={evidence.file_url} alt={title} className="max-w-full rounded-xl border border-gray-200" />
          )}

          {evidence.type === "file" && evidence.file_url && isPdf(evidence.file_url) && (
            <iframe src={evidence.file_url} title={title} className="w-full h-[70vh] rounded-xl border border-gray-200" />
          )}

          {evidence.type === "file" && evidence.file_url && !isImage(evidence.file_url) && !isPdf(evidence.file_url) && (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">{evidence.file_name || "This file"} can't be previewed inline.</p>
              <a href={evidence.file_url} target="_blank" rel="noreferrer">
                <Button><ExternalLink className="w-4 h-4 mr-1" /> Open / Download</Button>
              </a>
            </div>
          )}

          {evidence.type === "file" && evidence.file_url && (isImage(evidence.file_url) || isPdf(evidence.file_url)) && (
            <div className="flex justify-end">
              <a href={evidence.file_url} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-1" /> Open in new tab</Button>
              </a>
            </div>
          )}

          {evidence.type === "file" && !evidence.file_url && (
            <p className="text-sm text-gray-400">File URL is missing for this evidence item.</p>
          )}
          {evidence.type === "document" && !evidence.document_html && (
            <p className="text-sm text-gray-400">Document content is missing for this evidence item.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}