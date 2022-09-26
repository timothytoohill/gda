import { NbMenuItem } from '@nebular/theme';

export const MENU_ITEMS: NbMenuItem[] = [
    {
        title: 'Dashboard',
        icon: 'home-outline',
        link: '/dashboard',
        home: true,
    },
    {
        title: 'Graph DB Instances',
        icon: 'grid-outline',
        link: '/graphdb-instances',
    },
    {
        title: 'Jobs',
        icon: 'keypad-outline',
        link: '/jobs',
    },
    {
        title: 'SYSTEM',
        group: true,
    },
    {
        title: 'Realtime Monitor',
        icon: 'text-outline',
        link: '/system/logs/both',
    },
    {
        title: 'Profiles',
        icon: 'browser-outline',
        link: '/profiles',
    },
    {
        title: 'Read-Me',
        icon: 'edit-2-outline',
        link: '/readme',
    },
    {
        title: 'Configs',
        icon: 'shuffle-2-outline',
        link: '/appconfigs',
    },
    {
        title: 'DATA',
        group: true,
    },
    {
        title: 'ETL',
        group: true,
    },
    {
        title: 'Machine Learning',
        group: true,
    },
];
