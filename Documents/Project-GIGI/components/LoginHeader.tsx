import React from 'react';

const LoginHeader: React.FC = () => {
    const glowStyle: React.CSSProperties = {
        textShadow: '0 0 8px rgba(167, 139, 250, 0.8), 0 0 16px rgba(167, 139, 250, 0.6)'
    };

    return (
        // Wrapper similar to DashboardHeader, but with login-specific styling
        <div className="bg-[#000828] p-2 font-orbitron text-white text-center shadow-lg rounded-xl mb-6">
            <div className="bg-gigi-blue p-4 rounded-md border-2 border-gray-600">
                <div className="flex flex-col items-center justify-center gap-1">
                    <span style={glowStyle} className="text-lg sm:text-xl md:text-2xl font-bold tracking-wider">GENERATIONAL</span>
                    <div style={glowStyle} className="flex flex-col items-center text-[0.6rem] sm:text-xs font-bold leading-tight">
                        <span>INTERACTIVE</span>
                        <span>GUIDED</span>
                    </div>
                    <span style={glowStyle} className="text-lg sm:text-xl md:text-2xl font-bold tracking-wider">INTERFACE</span>
                    <h1 className="text-sm font-semibold tracking-[0.4em] text-violet-300 mt-2" style={glowStyle}>
                        G. I. G. I.
                    </h1>
                </div>
            </div>
        </div>
    );
};

export default LoginHeader;