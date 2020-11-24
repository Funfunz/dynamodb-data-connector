import { IEntityInfo } from "@funfunz/core/lib/generator/configurationTypes"

export const model: IEntityInfo = {
  name: 'funfunzUsersRoles',
  connector: 'teamDynamoDB',
  visible: true,
  roles: {
    create: [
      'all'
    ],
    read: [
      'all'
    ],
    update: [
      'all'
    ],
    delete: [
      'all'
    ]
  },
  relations: [
    {
      type: 'n:1',
      foreignKey: 'roleId',
      remoteTable: 'funfunzRoles'
    },
    {
      type: 'n:1',
      foreignKey: 'userId',
      remoteTable: 'funfunzUsers'
    },
  ],
  properties: [
    {
      name: 'userId',
      model: {
        type: 'text',
        allowNull: false,
        isPk: true,
      },
      layout: {
        label: 'User id',
      },
    },
    {
      name: 'roleId',
      model: {
        type: 'text',
        allowNull: false,
        isPk: true,
      },
      layout: {
        label: 'Role id',
      },
    },
    {
      name: 'createdAt',
      model: {
        type: 'text',
        allowNull: true,
      },
      layout: {
        label: 'Created at',
      },
    },
    {
      name: 'updatedAt',
      model: {
        type: 'text',
        allowNull: true,
      },
      layout: {
        label: 'Updated at',
      },
    },
  ],
  layout: {
    label: 'Users and roles relation',
  }
}