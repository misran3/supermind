interface TextInputProps {
    label?: string;
    type?: string;
    placeholder?: string;
    className?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    // [key: string]: any;
}

export const TextInput = ({
    label,
    type = 'text',
    placeholder,
    className = '',
    value,
    onChange,
    disabled
}: // ...props
TextInputProps) => (
    <div className={`space-y-1.5 ${className}`}>
        {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
        <input
            type={type}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 text-slate-900"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            // {...props}
        />
    </div>
);
