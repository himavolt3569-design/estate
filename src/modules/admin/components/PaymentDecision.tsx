'use client';

import { DecisionForm } from './DecisionForm';
import { reviewPayment } from '../actions';

/** Binds the shared decision control to the payment review action. */
export function PaymentDecision({ paymentId }: { paymentId: string }) {
  return (
    <DecisionForm
      approveLabel="Accept"
      rejectLabel="Reject"
      reasonLabel="Why is it rejected? The payer will see this."
      reasonPlaceholder="The screenshot shows a different amount from the one entered."
      minReason={5}
      onDecide={(decision, reason) => reviewPayment({ paymentId, decision, reason })}
    />
  );
}
