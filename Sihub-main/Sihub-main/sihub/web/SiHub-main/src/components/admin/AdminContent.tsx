import React from 'react';
import { BackendCMSManager } from './BackendCMSManager';
import { BackendSubmissionManager } from './BackendSubmissionManager';
import { CmsSectionBuilder } from './CmsSectionBuilder';

export const AdminContent: React.FC = () => (
  <div className="space-y-8">
    <CmsSectionBuilder />
    <BackendCMSManager />
    <BackendSubmissionManager />
  </div>
);
