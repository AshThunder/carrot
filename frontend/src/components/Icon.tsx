interface IconProps {
    name: string;
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    filled?: boolean;
}

const sizeClasses = {
    xs: 'text-[12px]',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
};

export function Icon({ name, className = '', size = 'md', filled = false }: IconProps) {
    return (
        <span
            className={`material-symbols-outlined ${sizeClasses[size]} ${className}`}
            style={{
                fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
            }}
        >
            {name}
        </span>
    );
}

export default Icon;
