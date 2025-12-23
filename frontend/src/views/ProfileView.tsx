import { Button } from '@/src/components/common/Button';
import { TextInput } from '@/src/components/common/TextInput';
import { Calendar, ChevronLeft, Edit2, LogOut, Mail, Save, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { useIntegrations } from '@/src/hooks/useIntegrations';
import type { ConnectorName, ThirdPartyIntegration } from '@/src/services/integrations.service';
import toast from 'react-hot-toast';

interface ProfileViewProps {
    onBack: () => void;
    onLogout: () => void;
}

export const ProfileView = ({ onBack, onLogout }: ProfileViewProps) => {
    const {
        profile,
        profileLoading,
        profileError,
        settings,
        settingsLoading,
        loadProfile,
        loadSettings,
        updateUserProfile,
        updateUserSettings,
    } = useUserProfile();

    const {
        integrations,
        integrationsLoading,
        integrationsError,
        loadIntegrations,
        connectIntegration,
        disconnectIntegration,
    } = useIntegrations();

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isEditingTone, setIsEditingTone] = useState(false);

    // Form state for editing - initialize directly from profile/settings
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editNickname, setEditNickname] = useState('');
    const [editPhoneNumber, setEditPhoneNumber] = useState('');
    const [editTimezone, setEditTimezone] = useState('');
    const [editToneOfResponse, setEditToneOfResponse] = useState('');

    // Track if form has been initialized to prevent cascading updates
    const [isFormInitialized, setIsFormInitialized] = useState(false);

    // Load profile, settings, and integrations on mount
    useEffect(() => {
        loadProfile();
        loadSettings();
        loadIntegrations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize form when profile loads (only once)
    useEffect(() => {
        if (profile && !isFormInitialized) {
            setEditFirstName(profile.firstName || '');
            setEditLastName(profile.lastName || '');
            setEditNickname(profile.nickname || '');
            setEditPhoneNumber(profile.phoneNumber || '');
            setEditTimezone(profile.timezone || '');
            setIsFormInitialized(true);
        }
    }, [profile, isFormInitialized]);

    // Initialize tone form when settings load (only once)
    useEffect(() => {
        if (settings && !isFormInitialized) {
            setEditToneOfResponse(settings.toneOfResponse || '');
        }
    }, [settings, isFormInitialized]);

    const handleSaveProfile = async () => {
        if (!editFirstName.trim() || !editLastName.trim()) {
            toast.error('First Name and Last Name are required');
            return;
        }

        const result = await updateUserProfile({
            firstName: editFirstName,
            lastName: editLastName,
            nickname: editNickname || undefined,
            phoneNumber: editPhoneNumber || undefined,
            timezone: editTimezone || undefined,
        });

        if (result) {
            toast.success('Profile updated successfully!');
            setIsEditingProfile(false);
        }
    };

    const handleSaveTone = async () => {
        const result = await updateUserSettings({
            toneOfResponse: editToneOfResponse,
        });

        if (result) {
            toast.success('Settings updated successfully!');
            setIsEditingTone(false);
        }
    };

    const displayName = profile
        ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User'
        : 'Loading...';
    const displayEmail = profile?.email || 'Loading...';
    const displayTone = settings?.toneOfResponse || 'Loading...';

    /**
     * ConnectorCard Component - Inline
     */
    const ConnectorCard = ({
        connector,
        integration,
        onConnect,
        onDisconnect,
        loading,
    }: {
        connector: ConnectorName;
        integration: ThirdPartyIntegration | undefined;
        onConnect: () => void;
        onDisconnect: () => void;
        loading: boolean;
    }) => {
        const isGmail = connector === 'gmail';
        const displayName = isGmail ? 'Gmail' : 'Google Calendar';
        const Icon = isGmail ? Mail : Calendar;

        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <Icon size={20} />
                        </div>

                        {/* Info */}
                        <div>
                            <p className="font-medium text-slate-900">{displayName}</p>

                            {/* Status Badge */}
                            {integration ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                        Connected
                                    </span>
                                    {integration.connectedEmail && (
                                        <span className="text-xs text-slate-500">{integration.connectedEmail}</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block">
                                    Not Connected
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    {integration ? (
                        <Button
                            variant="outline"
                            onClick={onDisconnect}
                            disabled={loading}
                            className="!text-sm !py-1.5 !px-3"
                        >
                            Disconnect
                        </Button>
                    ) : (
                        <Button onClick={onConnect} disabled={loading} className="!text-sm !py-1.5 !px-3">
                            Connect
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" onClick={onBack} className="!p-2">
                        <ChevronLeft size={20} />
                    </Button>
                    <h1 className="text-xl font-bold text-slate-900">Profile & Settings</h1>
                </div>
            </div>

            <div className="flex-1 max-w-3xl mx-auto w-full p-6 md:p-10 space-y-8">
                {/* Loading State */}
                {profileLoading && (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                        <div className="animate-pulse flex items-center space-x-6">
                            <div className="w-24 h-24 rounded-full bg-slate-200"></div>
                            <div className="flex-1">
                                <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
                                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {profileError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <p className="text-red-700">{profileError}</p>
                    </div>
                )}

                {/* Header Card */}
                {profile && !isEditingProfile && (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center space-x-6">
                                <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-2xl border-4 border-white shadow-lg">
                                    <User size={40} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
                                    {profile.nickname && (
                                        <p className="text-sm text-slate-500 italic">&quot;{profile.nickname}&quot;</p>
                                    )}
                                    <p className="text-slate-500 mt-1">{displayEmail}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => setIsEditingProfile(true)}
                                icon={Edit2}
                                className="!p-2"
                            >
                                Edit
                            </Button>
                        </div>

                        <div className="space-y-2 text-sm">
                            {profile.phoneNumber && (
                                <div className="flex items-center text-slate-600">
                                    <span className="font-medium w-24">Phone:</span>
                                    <span>{profile.phoneNumber}</span>
                                </div>
                            )}
                            {profile.timezone && (
                                <div className="flex items-center text-slate-600">
                                    <span className="font-medium w-24">Timezone:</span>
                                    <span>{profile.timezone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Profile Edit Form */}
                {isEditingProfile && (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                            <Button
                                variant="ghost"
                                onClick={() => setIsEditingProfile(false)}
                                className="!p-2"
                            >
                                <X size={20} />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <TextInput
                                        value={editFirstName}
                                        onChange={(e) => setEditFirstName(e.target.value)}
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Last Name <span className="text-red-500">*</span>
                                    </label>
                                    <TextInput
                                        value={editLastName}
                                        onChange={(e) => setEditLastName(e.target.value)}
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nickname <span className="text-slate-400">(optional)</span>
                                </label>
                                <TextInput
                                    value={editNickname}
                                    onChange={(e) => setEditNickname(e.target.value)}
                                    placeholder="What should we call you?"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Phone Number <span className="text-slate-400">(optional)</span>
                                </label>
                                <TextInput
                                    value={editPhoneNumber}
                                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Timezone <span className="text-slate-400">(optional)</span>
                                </label>
                                <TextInput
                                    value={editTimezone}
                                    onChange={(e) => setEditTimezone(e.target.value)}
                                    placeholder="America/New_York"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditingProfile(false)}
                                    disabled={profileLoading}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveProfile} icon={Save} disabled={profileLoading}>
                                    {profileLoading ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Sections */}
                <div className="space-y-6">
                    <section>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">
                            AI Preferences
                        </h3>

                        {/* Tone Setting - View Mode */}
                        {settings && !isEditingTone && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-900">Response Tone</p>
                                        <p className="text-sm text-slate-500 capitalize">{displayTone}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsEditingTone(true)}
                                        icon={Edit2}
                                        className="!p-2"
                                    >
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Tone Setting - Edit Mode */}
                        {isEditingTone && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-medium text-slate-900">Response Tone</h4>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsEditingTone(false)}
                                        className="!p-2"
                                    >
                                        <X size={20} />
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:border-indigo-600 transition-colors">
                                        <input
                                            type="radio"
                                            name="tone"
                                            value="concise and direct"
                                            checked={editToneOfResponse === 'concise and direct'}
                                            onChange={(e) => setEditToneOfResponse(e.target.value)}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-900">Concise & Direct</div>
                                            <div className="text-sm text-slate-500">
                                                Bullet points, short sentences, action-oriented.
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:border-indigo-600 transition-colors">
                                        <input
                                            type="radio"
                                            name="tone"
                                            value="professional and friendly"
                                            checked={editToneOfResponse === 'professional and friendly'}
                                            onChange={(e) => setEditToneOfResponse(e.target.value)}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-900">Professional & Friendly</div>
                                            <div className="text-sm text-slate-500">
                                                Balanced tone with clear explanations.
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:border-indigo-600 transition-colors">
                                        <input
                                            type="radio"
                                            name="tone"
                                            value="detailed and conversational"
                                            checked={editToneOfResponse === 'detailed and conversational'}
                                            onChange={(e) => setEditToneOfResponse(e.target.value)}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-900">Detailed & Conversational</div>
                                            <div className="text-sm text-slate-500">
                                                Full explanations with examples and friendly tone.
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex justify-end space-x-3 mt-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsEditingTone(false)}
                                        disabled={settingsLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveTone} icon={Save} disabled={settingsLoading}>
                                        {settingsLoading ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Connected Accounts Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">
                            Connected Accounts
                        </h3>

                        {/* Loading State */}
                        {integrationsLoading && integrations.length === 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <div className="animate-pulse flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {integrationsError && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
                                <p className="text-red-700 text-sm">{integrationsError}</p>
                            </div>
                        )}

                        {/* Connectors */}
                        <div className="space-y-3">
                            {/* Gmail Connector */}
                            <ConnectorCard
                                connector="gmail"
                                integration={integrations.find((i) => i.connectorName === 'gmail')}
                                onConnect={() => connectIntegration('gmail')}
                                onDisconnect={() => disconnectIntegration('gmail')}
                                loading={integrationsLoading}
                            />

                            {/* Google Calendar Connector */}
                            <ConnectorCard
                                connector="google_calendar"
                                integration={integrations.find((i) => i.connectorName === 'google_calendar')}
                                onConnect={() => connectIntegration('google_calendar')}
                                onDisconnect={() => disconnectIntegration('google_calendar')}
                                loading={integrationsLoading}
                            />
                        </div>
                    </section>

                    <Button
                        variant="outline"
                        className="w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 mt-8"
                        onClick={onLogout}
                        icon={LogOut}
                    >
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
    );
};
