'use client'

import { createContext, createElement, useContext, type ReactNode } from 'react'

const NewDesignContext = createContext<boolean>(false)

export function NewDesignProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return createElement(NewDesignContext.Provider, { value }, children)
}

export function useNewDesignFlag(): boolean {
  return useContext(NewDesignContext)
}
