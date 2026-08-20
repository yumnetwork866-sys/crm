import React from 'react';
import { Send, Zap } from 'lucide-react';
import type {
  BroadcastCampaign,
  Customer,
  LaunchCampaignInput,
  WhatsAppApprovedTemplate,
} from '../../types';
import { BroadcastView } from '../Broadcast/BroadcastView';
import { AutomationView } from './AutomationView';

export type AutomationSection = 'workflow' | 'broadcast';

interface AutomationHubProps {
  activeSection: AutomationSection;
  onChangeSection: (section: AutomationSection) => void;
  customers: Customer[];
  campaigns: BroadcastCampaign[];
  approvedTemplates: WhatsAppApprovedTemplate[];
  isTemplatesLoading: boolean;
  templatesError: Error | null;
  onRefetchTemplates: () => void;
  defaultTargetGroup?: string;
  onRunSimulation: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onLaunchCampaign: (input: LaunchCampaignInput) => Promise<BroadcastCampaign>;
  isLaunchPending: boolean;
  launchError: Error | null;
  onResetLaunchError: () => void;
}

const sections = [
  {
    id: 'workflow' as const,
    label: 'Chăm sóc tự động',
    description: 'Quy trình WhatsApp sau mua',
    icon: Zap,
  },
  {
    id: 'broadcast' as const,
    label: 'Gửi hàng loạt',
    description: 'Chiến dịch WhatsApp theo nhóm',
    icon: Send,
  },
];

export const AutomationHub: React.FC<AutomationHubProps> = ({
  activeSection,
  onChangeSection,
  customers,
  campaigns,
  approvedTemplates,
  isTemplatesLoading,
  templatesError,
  onRefetchTemplates,
  defaultTargetGroup = 'Tất cả khách hàng',
  onRunSimulation,
  onSelectCustomer,
  onLaunchCampaign,
  isLaunchPending,
  launchError,
  onResetLaunchError,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="tablist"
          aria-label="Chức năng Automation"
        >
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChangeSection(section.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-900 shadow-sm'
                    : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{section.label}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {section.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {activeSection === 'workflow' ? (
          <AutomationView
            customers={customers}
            onRunSimulation={onRunSimulation}
            onSelectCustomer={onSelectCustomer}
          />
        ) : (
          <BroadcastView
            customers={customers}
            campaigns={campaigns}
            approvedTemplates={approvedTemplates}
            isTemplatesLoading={isTemplatesLoading}
            templatesError={templatesError}
            onRefetchTemplates={onRefetchTemplates}
            onLaunchCampaign={onLaunchCampaign}
            isLaunchPending={isLaunchPending}
            launchError={launchError}
            onResetLaunchError={onResetLaunchError}
            defaultTargetGroup={defaultTargetGroup}
          />
        )}
      </div>
    </div>
  );
};
