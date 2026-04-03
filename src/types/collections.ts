import { StatusFilter } from "./constants";

export type GRRow = {
  gr_no: string;
  area_manager: string;
  branch_code: string;
  gr_date: string;
  party_name: string;
  total_freight: number;
  pay_mode: string | null;
  payment_mode: string | null;
  received_amount: number | null;
  payment_date: string | null;
  ref_no: string | null;
  remarks: string | null;
  status_calc?: StatusFilter;
};

export type EditState = {
  payment_mode: string;
  received_amount: string;
  payment_date: string;
  ref_no: string;
  remarks: string;
};
