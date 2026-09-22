ALTER TABLE "AutomationEventExecution"
DROP CONSTRAINT "AutomationEventExecution_automationId_fkey";

ALTER TABLE "AutomationEventExecution"
ADD CONSTRAINT "AutomationEventExecution_automationId_fkey"
FOREIGN KEY ("automationId") REFERENCES "Automation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
