import { apiFetch } from '@shift/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface PendingDocument {
  id: string;
  workerId: string;
  workerFullName: string;
  createdAt: string;
}

export interface PendingCompany {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
}

export interface PendingSkillCategory {
  id: string;
  name: string;
  createdByName: string | null;
}

export interface PendingVerifications {
  documents: PendingDocument[];
  companies: PendingCompany[];
  skillCategories: PendingSkillCategory[];
}

export function listPendingVerifications(): Promise<PendingVerifications> {
  return apiFetch('/admin/verifications');
}

export interface AdminMetrics {
  payments: {
    totalProcessed: string;
    countByStatus: Record<string, number>;
  };
  workers: {
    total: number;
    verified: number;
    active: number;
  };
  companies: {
    total: number;
    verified: number;
    jobsPosted: number;
  };
  shifts: {
    completed: number;
    cancelled: number;
    noShow: number;
  };
}

export function getAdminMetrics(): Promise<AdminMetrics> {
  return apiFetch('/admin/metrics');
}

export function reviewDocument(
  documentId: string,
  status: 'approved' | 'rejected',
): Promise<{ id: string; status: string }> {
  return apiFetch(`/admin/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function reviewCompany(
  companyId: string,
  status: 'approved' | 'rejected',
): Promise<{ id: string; verificationStatus: string }> {
  return apiFetch(`/admin/companies/${companyId}/verification`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteDemoData(): Promise<{ companiesRemoved: number }> {
  return apiFetch('/admin/demo-data', { method: 'DELETE' });
}

export function reviewSkillCategory(
  categoryId: string,
  status: 'approved' | 'rejected',
  name?: string,
): Promise<{ id: string; name: string; status: string }> {
  return apiFetch(`/admin/skill-categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, name }),
  });
}

export interface DocumentFile {
  url: string;
  contentType: string;
}

/**
 * Não usa apiFetch porque a resposta é o arquivo cru (imagem ou PDF),
 * não JSON — o cookie de sessão ainda precisa ir (`credentials:
 * 'include'`), só a leitura da resposta que é diferente.
 *
 * `contentType` vem junto pra tela decidir como mostrar: `<img>` pra
 * imagem, um link/embed pra PDF (documento de identidade aceita os dois).
 */
export async function fetchDocumentFile(documentId: string): Promise<DocumentFile> {
  const response = await fetch(`${API_URL}/admin/documents/${documentId}/file`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Não foi possível carregar o documento.');
  }
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), contentType: blob.type };
}
