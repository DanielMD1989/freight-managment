'use client';

/**
 * Dashboard Design Preview Page
 *
 * Shows 3 color palette options for dashboard redesign
 * Sprint 20 - Dashboard Visual Redesign
 */

import React, { useState } from 'react';

type ColorOption = 'A' | 'B' | 'C';

// Color Palettes
const palettes = {
  A: {
    name: 'Light & Clean',
    inspiration: 'Stripe Dashboard',
    colors: {
      background: '#FAFAFA',
      card: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarBorder: '#E5E7EB',
      primary: '#0066FF',
      primaryLight: '#EBF5FF',
      accent: '#10B981',
      accentLight: '#D1FAE5',
      textPrimary: '#1A1A2E',
      textSecondary: '#6B7280',
      textMuted: '#9CA3AF',
      border: '#E5E7EB',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    }
  },
  B: {
    name: 'Dark & Professional',
    inspiration: 'Linear',
    colors: {
      background: '#0A0A0F',
      card: '#16161D',
      sidebar: '#111117',
      sidebarBorder: '#27272A',
      primary: '#8B5CF6',
      primaryLight: '#8B5CF620',
      accent: '#14B8A6',
      accentLight: '#14B8A620',
      textPrimary: '#F9FAFB',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      border: '#27272A',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    }
  },
  C: {
    name: 'Neutral & Minimal',
    inspiration: 'Notion',
    colors: {
      background: '#F7F7F5',
      card: '#FFFFFF',
      sidebar: '#FBFBFA',
      sidebarBorder: '#E3E2DE',
      primary: '#2F81F7',
      primaryLight: '#2F81F715',
      accent: '#E16F24',
      accentLight: '#E16F2415',
      textPrimary: '#37352F',
      textSecondary: '#787774',
      textMuted: '#9B9A97',
      border: '#E3E2DE',
      success: '#0F7B6C',
      warning: '#D9730D',
      error: '#E03E3E',
    }
  }
};

export default function DashboardPreviewPage() {
  const [activeOption, setActiveOption] = useState<ColorOption>('A');
  const palette = palettes[activeOption];
  const colors = palette.colors;

  return (
    <div style={{ minHeight: '100vh', background: '#18181B', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#FAFAFA', marginBottom: '8px' }}>
            Dashboard Design Preview
          </h1>
          <p style={{ fontSize: '16px', color: '#9CA3AF' }}>
            Sprint 20 - Choose your preferred color palette
          </p>
        </div>

        {/* Option Selector */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          {(['A', 'B', 'C'] as ColorOption[]).map((option) => (
            <button
              key={option}
              onClick={() => setActiveOption(option)}
              style={{
                padding: '16px 32px',
                borderRadius: '12px',
                border: activeOption === option ? '2px solid #14B8A6' : '2px solid #27272A',
                background: activeOption === option ? '#14B8A620' : '#1F1F23',
                color: activeOption === option ? '#14B8A6' : '#9CA3AF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 600,
              }}
            >
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>Option {option}</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>{palettes[option].name}</div>
            </button>
          ))}
        </div>

        {/* Preview Container */}
        <div style={{
          background: colors.background,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}>
          {/* Dashboard Layout Preview */}
          <div style={{ display: 'flex', minHeight: '700px' }}>
            {/* Sidebar */}
            <div style={{
              width: '240px',
              background: colors.sidebar,
              borderRight: `1px solid ${colors.sidebarBorder}`,
              padding: '24px 16px',
              flexShrink: 0,
            }}>
              {/* Logo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '32px',
                paddingLeft: '8px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10" />
                    <path d="M13 6h5l3 5v5h-4" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '16px' }}>FreightET</div>
                  <div style={{ fontSize: '12px', color: colors.textMuted }}>Shipper</div>
                </div>
              </div>

              {/* Nav Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { label: 'Dashboard', active: true },
                  { label: 'Map' },
                  { label: 'Post Loads' },
                  { label: 'Search Trucks' },
                  { label: 'My Loads' },
                  { label: 'Wallet' },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: item.active ? colors.primaryLight : 'transparent',
                      color: item.active ? colors.primary : colors.textSecondary,
                      fontSize: '14px',
                      fontWeight: item.active ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{
                height: '64px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 32px',
                background: colors.card,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <input
                    placeholder="Search..."
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.background,
                      color: colors.textPrimary,
                      fontSize: '14px',
                      width: '240px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: colors.background,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.textSecondary,
                  }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: colors.primary,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}>
                    JD
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div style={{ padding: '32px', overflow: 'auto' }}>
                {/* Welcome */}
                <div style={{ marginBottom: '32px' }}>
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: colors.textPrimary,
                    marginBottom: '8px'
                  }}>
                    Welcome back, John
                  </h1>
                  <p style={{ color: colors.textSecondary, fontSize: '15px' }}>
                    Here's an overview of your shipping operations
                  </p>
                </div>

                {/* Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '20px',
                  marginBottom: '32px',
                }}>
                  {[
                    { label: 'Total Loads', value: '24', change: '+12%', color: colors.primary },
                    { label: 'Active Shipments', value: '8', change: '+5%', color: colors.accent },
                    { label: 'Delivered', value: '156', change: '+18%', color: colors.success },
                    { label: 'Total Spent', value: '45,230 ETB', change: '-3%', color: colors.warning },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      style={{
                        background: colors.card,
                        borderRadius: '12px',
                        padding: '20px 24px',
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: `${stat.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: stat.color,
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: stat.change.startsWith('+') ? colors.success : colors.error,
                          fontWeight: 500,
                        }}>
                          {stat.change}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        color: colors.textPrimary,
                        marginBottom: '4px'
                      }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div style={{ marginBottom: '32px' }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: colors.textPrimary,
                    marginBottom: '16px'
                  }}>
                    Quick Actions
                  </h2>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { label: 'Post New Load', primary: true },
                      { label: 'Track Shipments' },
                      { label: 'Find Trucks' },
                    ].map((action, i) => (
                      <button
                        key={i}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: action.primary ? 'none' : `1px solid ${colors.border}`,
                          background: action.primary ? colors.primary : colors.card,
                          color: action.primary ? 'white' : colors.textPrimary,
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {action.primary && (
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  {/* Active Shipments */}
                  <div style={{
                    background: colors.card,
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: `1px solid ${colors.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
                        Active Shipments
                      </h3>
                      <button style={{
                        color: colors.primary,
                        fontSize: '14px',
                        fontWeight: 500,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}>
                        View All
                      </button>
                    </div>
                    <div>
                      {[
                        { from: 'Addis Ababa', to: 'Dire Dawa', status: 'In Transit', progress: 65 },
                        { from: 'Hawassa', to: 'Bahir Dar', status: 'Picked Up', progress: 25 },
                        { from: 'Mekelle', to: 'Jimma', status: 'Pending', progress: 0 },
                      ].map((shipment, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '16px 24px',
                            borderBottom: i < 2 ? `1px solid ${colors.border}` : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: colors.textPrimary,
                              marginBottom: '4px'
                            }}>
                              {shipment.from} → {shipment.to}
                            </div>
                            <div style={{
                              height: '4px',
                              background: colors.border,
                              borderRadius: '2px',
                              width: '200px',
                              marginTop: '8px',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${shipment.progress}%`,
                                background: colors.primary,
                                borderRadius: '2px',
                              }} />
                            </div>
                          </div>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 500,
                            background: shipment.status === 'In Transit' ? `${colors.primary}15` :
                                       shipment.status === 'Picked Up' ? `${colors.accent}15` : `${colors.border}`,
                            color: shipment.status === 'In Transit' ? colors.primary :
                                  shipment.status === 'Picked Up' ? colors.accent : colors.textSecondary,
                          }}>
                            {shipment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notifications */}
                  <div style={{
                    background: colors.card,
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: `1px solid ${colors.border}`,
                    }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
                        Recent Activity
                      </h3>
                    </div>
                    <div style={{ padding: '16px 24px' }}>
                      {[
                        { text: 'Load #1234 delivered successfully', time: '2h ago', type: 'success' },
                        { text: 'New carrier application', time: '4h ago', type: 'info' },
                        { text: 'Payment received', time: '1d ago', type: 'success' },
                      ].map((activity, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            marginBottom: i < 2 ? '16px' : 0,
                          }}
                        >
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: activity.type === 'success' ? colors.success : colors.primary,
                            marginTop: '6px',
                            flexShrink: 0,
                          }} />
                          <div>
                            <div style={{ fontSize: '14px', color: colors.textPrimary }}>
                              {activity.text}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textMuted }}>
                              {activity.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Color Palette Display */}
        <div style={{
          marginTop: '40px',
          background: '#1F1F23',
          borderRadius: '16px',
          padding: '32px',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#FAFAFA',
            marginBottom: '24px'
          }}>
            Color Palette: {palette.name}
          </h2>
          <p style={{ color: '#9CA3AF', marginBottom: '24px', fontSize: '14px' }}>
            Inspired by {palette.inspiration}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '16px'
          }}>
            {Object.entries(colors).slice(0, 12).map(([name, color]) => (
              <div key={name}>
                <div style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '8px',
                  background: color,
                  border: '1px solid #27272A',
                  marginBottom: '8px',
                }} />
                <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{name}</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>{color}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Selection Button */}
        <div style={{
          marginTop: '32px',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <button
            style={{
              padding: '16px 48px',
              borderRadius: '12px',
              background: '#14B8A6',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Select Option {activeOption}: {palette.name}
          </button>
        </div>
      </div>
    </div>
  );
}
