import { Tab, TabGroup, TabList } from '@tremor/react';
import { tabs } from '../../app/tabs';
import type { TabId } from '../../types/dashboard';

export function DashboardTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const activeTabIndex = Math.max(tabs.findIndex((item) => item.id === activeTab), 0);

  return (
    <TabGroup
      index={activeTabIndex}
      onIndexChange={(index) => {
        const nextTab = tabs[index]?.id;
        if (nextTab) onTabChange(nextTab);
      }}
    >
      <TabList variant="solid" color="emerald" className="mb-4 w-full overflow-x-auto sm:mb-5">
        {tabs.map((item) => (
          <Tab key={item.id} icon={item.icon} className="text-xs sm:text-sm">
            {item.label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
}
