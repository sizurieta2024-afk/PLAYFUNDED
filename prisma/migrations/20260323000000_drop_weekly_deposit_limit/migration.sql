-- Drop weekly deposit limit column — feature removed
ALTER TABLE "User" DROP COLUMN IF EXISTS "weeklyDepositLimit";
