import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  // flush: bỏ khoảng dưới khối tiêu đề (mb-6 -> mb-0) để khối tiếp theo nằm
  // sát ngay dưới, không còn khe. Mặc định false nên các màn khác không đổi.
  flush?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs,
  flush,
}) => {
  return (
    <div className={`${flush ? 'mb-0' : 'mb-6'} pb-4 border-b border-[#E6DCC8]/80 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-1.5" aria-label="Breadcrumb">
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[#9CA3AF]">/</span>}
                {b.onClick ? (
                  <button
                    onClick={b.onClick}
                    className="hover:text-[#2F3E6B] font-medium transition-colors"
                  >
                    {b.label}
                  </button>
                ) : (
                  <span className="text-[#2F3E6B] font-semibold">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <h1 className="font-lora text-2xl sm:text-3xl font-bold text-[#2F3E6B] tracking-tight">
            {title}
          </h1>
          {badge}
        </div>

        {subtitle && (
          <p className="text-sm text-[#4B5563] mt-1 font-normal leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
