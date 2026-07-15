export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}
