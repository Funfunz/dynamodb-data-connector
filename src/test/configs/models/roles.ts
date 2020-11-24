import { IEntityInfo } from "@funfunz/core/lib/generator/configurationTypes"

export const model: IEntityInfo = {
  name: 'funfunzRoles',
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
      type: '1:n',
      foreignKey: 'roleId',
      remoteTable: 'funfunzUsersRoles'
    },
    {
      type: 'm:n',
      foreignKey: 'roleId',
      relationalTable: 'funfunzUsersRoles',
      remoteTable: 'funfunzUsers',
      remoteForeignKey: 'userId',
    }
  ],
  properties: [
    {
      name: 'roleId',
      model: {
        type: 'text',
        allowNull: false,
        isPk: true,
      },
      layout: {
        label: 'Id',
      },
    },
    {
      name: 'name',
      model: {
        type: 'text',
        allowNull: true
      },
      layout: {
        label: 'Name',
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
    label: 'Roles',
  }
}