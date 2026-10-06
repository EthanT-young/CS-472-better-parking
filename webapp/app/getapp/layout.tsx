import React from "react";

export default function GetAppLayout({children,}: {children: React.ReactNode;}) {
    return(
        <div>
            <h1>GetApp Layout</h1>
            <div>{children}</div>
        </div>
    )
}