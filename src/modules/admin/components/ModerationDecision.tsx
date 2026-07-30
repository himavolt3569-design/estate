'use client';

import { DecisionForm } from './DecisionForm';
import { moderateProperty } from '../actions';

/** Binds the shared decision control to the listing moderation action. */
export function ModerationDecision({ propertyId }: { propertyId: string }) {
  return (
    <DecisionForm
      approveLabel="Publish"
      rejectLabel="Send back"
      reasonLabel="What does the lister need to fix? They will see this."
      reasonPlaceholder="The photos do not show the whole plot, and the lalpurja is not readable."
      minReason={10}
      onDecide={(decision, reason) => moderateProperty({ propertyId, decision, reason })}
    />
  );
}
