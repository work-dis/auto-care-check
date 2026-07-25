export type VehicleWorkspaceTab = 'plans' | 'records' | 'observations';

const TABS: Array<{ value: VehicleWorkspaceTab; label: string }> = [
  { value: 'plans', label: 'Планы обслуживания' },
  { value: 'records', label: 'История обслуживания' },
  { value: 'observations', label: 'Наблюдения' },
];

export function VehicleWorkspaceTabs({
  activeTab,
  onChange,
}: {
  activeTab: VehicleWorkspaceTab;
  onChange: (tab: VehicleWorkspaceTab) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b border-neutral-800" role="tablist" aria-label="Разделы автомобиля">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onChange(tab.value)}
          className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === tab.value
              ? 'border-teal-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
