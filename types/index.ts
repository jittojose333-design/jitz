export type PaymentStatus = 'Paid' | 'Unpaid' | 'No Bill';
export type DateRange = 'today' | 'this-week' | 'this-month' | 'last-3-months' | 'this-year' | 'ytd' | 'custom';

export interface BoardPrices {
  type1: number;
  type2: number;
  type3: number;
  type4: number;
}

export interface Panchayat {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  boardPrices: BoardPrices;
  vendors: string[]; // List of vendor names to match
  district?: string;
  block?: string;
  nregaGP?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  panchayatId: string;
  panchayatName: string;
  date: string;
  items: string;
  quantity: number;
  rate: number;
  amount: number;
  boardType: keyof BoardPrices;
  status: PaymentStatus;
  workCode?: string;
  workName?: string;
  isPlaced: boolean;
  isVerified?: boolean;
  verifiedAmount?: number;
  verifiedDate?: string;
  paymentDate?: string; // NREGA Payment Date
}

export interface ExpenseCategory {
  id: string;
  name: string;
  subCategories: string[];
  isPanchayatLinked: boolean;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  categoryName: string; // Denormalized for easier display
  subCategory?: string;
  panchayatId?: string; // Optional link to project
}

export interface Income {
  id: string;
  date: string;
  description: string;
  amount: number;
  source: string;
}
