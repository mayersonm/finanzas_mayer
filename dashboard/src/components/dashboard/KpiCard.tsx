import { Card, Metric, Text, type Color } from '@tremor/react';

export function KpiCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: Color;
}) {
  return (
    <Card decoration="top" decorationColor={color} className="rounded-tremor-default">
      <Text>{label}</Text>
      <Metric className="mt-2 truncate text-2xl sm:text-3xl">{value}</Metric>
      <Text className="mt-2">{detail}</Text>
    </Card>
  );
}
