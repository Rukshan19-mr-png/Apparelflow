export type UserRole = 'cutting_supervisor' | 'cutting_verifier' | 'sewing_supervisor';

export type OrderStatus =
  | 'CUTTING_IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'REJECTED'
  | 'VERIFIED'
  | 'SEWING_QUEUE'
  | 'SEWING_STARTED';

export type ComponentQCStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface ProductionRecipe {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: RecipeComponentData[];
}

export interface RecipeComponentData {
  id: string;
  componentName: string;
  piecesPerGarment: number;
  imageUrl?: string | null;
}

export interface VerificationItemState {
  id: string;
  componentId: string;
  componentName: string;
  piecesPerGarment: number;
  expectedQty: number;
  actualQty: number | null;
  status: ComponentQCStatus | null;
}

export interface CuttingOrderSummary {
  id: string;
  orderNo: string;
  recipeId: string;
  recipeName: string;
  recipeCode: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  expectedFabricYds: number;
  wastagePct: number | null;
  status: OrderStatus;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  items: VerificationItemState[];
  latestLog?: {
    verifierId: string;
    verifierName: string;
    decision: string;
    rejectionNote?: string | null;
    wastagePct: number;
    timestamp: string;
  } | null;
}
