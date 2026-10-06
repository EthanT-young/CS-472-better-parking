import React from "react";

export default function AboutLayout({children,}: {children: React.ReactNode;}) {
    return(
        <div>
            <h1>About Layout</h1>
            <div>{children}</div>
        </div>
    )
}