import React from 'react';
import { LOGO_OFFICIAL_URL, LOGO_SYMBOL_URL, BRAND_ALT } from '../assets/logo.ts';

export interface BrandWordmarkProps {
  /**
   * Kích thước chữ:
   * - 'xs': text-base (16px)
   * - 'sm': text-xl (20px) - Dành cho Header Mobile
   * - 'md': text-2xl sm:text-3xl (24-30px) - Dành cho Sidebar Desktop / Màn "Sắp ra mắt"
   * - 'lg': text-3xl sm:text-4xl (30-36px) - Dành cho Màn Đăng nhập
   * - 'xl': text-4xl sm:text-5xl (36-48px)
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  sloganText?: string;
  className?: string;
  align?: 'left' | 'center';
}

/**
 * Component BrandWordmark tái sử dụng trên toàn app:
 * - Chữ "Mầm" màu xanh lá đậm (#1E5238), giữ chữ "â" có dấu mũ bình thường.
 * - Dấu huyền hình chiếc lá SVG thon nghiêng xéo từ trái trên xuống phải dưới (giống dấu huyền ̀),
 *   đầu lá nhọn hướng xuống bên phải, màu xanh lá của logo, đặt ngay phía trên chữ â, bên phải dấu mũ,
 *   đúng vị trí dấu huyền trong chữ "ầ". Sử dụng đơn vị 'em' để luôn cân đối chuẩn xác ở mọi cỡ chữ!
 * - Chữ "Văn" màu vàng hoàng kim (#C38F36); phông chữ tiêu đề Lora.
 * - Hỗ trợ aria-label="Mầm Văn" cho trình đọc màn hình.
 */
export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  size = 'md',
  showSlogan = false,
  sloganText = 'Ngữ văn lớp 7',
  className = '',
  align = 'left',
}) => {
  const sizeStyles = {
    xs: {
      text: 'text-base',
      slogan: 'text-[10px]',
      gap: 'gap-1',
    },
    sm: {
      text: 'text-xl sm:text-2xl',
      slogan: 'text-[11px]',
      gap: 'gap-1.5',
    },
    md: {
      text: 'text-2xl lg:text-[28px]',
      slogan: 'text-xs',
      gap: 'gap-2',
    },
    lg: {
      text: 'text-3xl sm:text-4xl',
      slogan: 'text-sm',
      gap: 'gap-2.5',
    },
    xl: {
      text: 'text-4xl sm:text-5xl',
      slogan: 'text-base',
      gap: 'gap-3',
    },
  };

  const current = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      className={`inline-flex flex-col select-none ${
        align === 'center' ? 'items-center text-center' : 'items-start text-left'
      } ${className}`}
      role="img"
      aria-label="Mầm Văn"
    >
      <div
        className={`flex items-baseline whitespace-nowrap font-serif font-bold tracking-tight ${current.text}`}
        style={{ fontFamily: "'Lora', 'Be Vietnam Pro', Georgia, serif" }}
        aria-hidden="true"
      >
        {/* Chữ "Mầm" (xanh lá đậm) với dấu huyền hình chiếc lá xanh của logo */}
        <span className="text-[#1E5238] relative inline-block whitespace-nowrap">
          M
          {/* Chữ "â" gắn chiếc lá dấu huyền nghiêng xéo */}
          <span className="relative inline-block">
            â
            {/* SVG CHIẾC LÁ DẤU HUYỀN */}
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute pointer-events-none select-none"
              style={{
                width: '0.40em',
                height: '0.40em',
                top: '-0.24em',
                left: '0.46em',
              }}
              aria-hidden="true"
            >
              {/* Thân lá thon nghiêng góc ~45 độ từ trái trên xuống phải dưới */}
              <path
                d="M 6 7 C 12 5, 22 12, 26 25 C 19 24, 11 18, 6 12 C 5 10, 5 8, 6 7 Z"
                fill="#367345"
              />
              <path
                d="M 7 8 C 12 7, 20 12, 24 23 C 19 22, 12 17, 8 13 Z"
                fill="#4D8F5A"
                opacity="0.9"
              />
              {/* Gân lá / vệt sáng thanh thoát */}
              <path
                d="M 8 9 C 14 13, 20 18, 24 23"
                stroke="#88C995"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
          </span>
          m
        </span>

        {/* Khoảng cách giữa "Mầm" và "Văn" */}
        <span className="inline-block w-1.5 sm:w-2" />

        {/* Chữ "Văn" (vàng hoàng kim / vàng mật) */}
        <span className="text-[#C38F36]">
          Văn
        </span>
      </div>

      {/* Dòng slogan phụ nếu được bật */}
      {showSlogan && (
        <p
          className={`font-sans font-medium text-[#447257] tracking-wide mt-0.5 ${current.slogan}`}
        >
          {sloganText}
        </p>
      )}
    </div>
  );
};

export interface BrandLogoIconProps {
  /**
   * Kích thước ô icon (vuông):
   * - 'sm': 40px (Mobile Header)
   * - 'md': 46px (Desktop Sidebar)
   * - 'lg': 60px
   */
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
}

/**
 * Biểu tượng logo cắt từ ảnh logo chính thức bằng CSS:
 * - Nền kem #FAF5EB
 * - background-size: 156%
 * - background-position: 50% 21%
 * - Cắt chuẩn phần quyển sách mở + mầm cây lá ngòi bút máy, không lộ chữ bên dưới
 */
export const BrandLogoIcon: React.FC<BrandLogoIconProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-11 h-11 lg:w-12 lg:h-12 rounded-2xl',
    lg: 'w-16 h-16 rounded-2xl',
  };

  const styleObj: React.CSSProperties = {
    backgroundImage: `url(${LOGO_OFFICIAL_URL})`,
    backgroundSize: '156%',
    backgroundPosition: '50% 20.5%',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#FAF5EB',
  };

  if (typeof size === 'number') {
    styleObj.width = `${size}px`;
    styleObj.height = `${size}px`;
  }

  const dimensionClass = typeof size === 'string' ? sizeMap[size] || sizeMap.md : 'rounded-2xl';

  return (
    <div
      className={`shrink-0 border border-[#EADBBE]/85 shadow-xs overflow-hidden transition-transform duration-200 hover:scale-105 ${dimensionClass} ${className}`}
      style={styleObj}
      role="img"
      aria-label={BRAND_ALT}
    />
  );
};

export interface BrandFullLogoProps {
  className?: string;
  widthClass?: string;
}

/**
 * Ảnh Logo Đầy Đủ chính thức (Quyển sách + Mầm ngòi bút + Chữ Mầm Văn)
 * Dành cho Màn Đăng nhập và Màn Chờ / Splash
 * Rộng 200–260px trên Desktop và 160–200px trên Mobile, căn giữa, object-fit contain.
 */
export const BrandFullLogo: React.FC<BrandFullLogoProps> = ({
  className = '',
  widthClass = 'w-44 sm:w-56 md:w-60',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src={LOGO_OFFICIAL_URL}
        alt={BRAND_ALT}
        className={`${widthClass} h-auto object-contain mx-auto transition-transform duration-300 hover:scale-[1.02]`}
        loading="eager"
      />
    </div>
  );
};

export interface BrandHeaderLockupProps {
  size?: 'sm' | 'md';
  showSlogan?: boolean;
  sloganText?: string;
  className?: string;
}

/**
 * Bố cục thương hiệu chuẩn cho Header & Sidebar:
 * Kết hợp BrandLogoIcon (ô cắt biểu tượng) + BrandWordmark (chữ sống)
 */
export const BrandHeaderLockup: React.FC<BrandHeaderLockupProps> = ({
  size = 'md',
  showSlogan = true,
  sloganText = 'Ngữ văn lớp 7',
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <BrandLogoIcon size={size} />
      <BrandWordmark
        size={size}
        showSlogan={showSlogan}
        sloganText={sloganText}
        align="left"
      />
    </div>
  );
};

// ================= TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY) =================
export const MamVanSymbol = BrandLogoIcon;
export const MamVanWordmark = BrandWordmark;

export interface MamVanLogoProps {
  variant?: 'vertical' | 'horizontal' | 'symbol' | 'image';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  sloganText?: string;
  className?: string;
}

export const MamVanLogo: React.FC<MamVanLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showSlogan = true,
  sloganText = 'Ngữ văn lớp 7',
  className = '',
}) => {
  if (variant === 'symbol') {
    return <BrandLogoIcon size={size === 'sm' ? 'sm' : 'md'} className={className} />;
  }

  if (variant === 'image' || variant === 'vertical') {
    return <BrandFullLogo className={className} />;
  }

  // variant horizontal:
  return (
    <BrandHeaderLockup
      size={size === 'sm' ? 'sm' : 'md'}
      showSlogan={showSlogan}
      sloganText={sloganText}
      className={className}
    />
  );
};

export default MamVanLogo;
