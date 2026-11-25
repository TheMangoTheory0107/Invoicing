export interface CategoryOption {
  id: string;
  name: string;
  kind: string; // EXPENSE | INVESTMENT | INCOME | TRANSFER
  bucket: string; // NEEDS | WANTS
}

export const SERIES = {
  needs: "#257de0",
  wants: "#f47230",
  invested: "#00b894",
  unspent: "#e2e8f0",
};
