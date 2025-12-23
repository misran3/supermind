interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
    className?: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    fullWidth?: boolean;
    disabled?: boolean;
}

export const Button = ({
    children,
    onClick,
    variant = 'primary',
    className = '',
    icon: Icon,
    fullWidth = false,
    disabled = false,
}: ButtonProps) => {
    const baseStyles =
        'inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 shadow-sm',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 bg-white',
    };

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            disabled={disabled}
        >
            {Icon && <Icon size={18} className="mr-2" />}
            {children}
        </button>
    );
};
